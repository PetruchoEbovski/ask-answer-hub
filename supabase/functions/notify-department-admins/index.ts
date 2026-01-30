import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";
import { Resend } from "resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QuestionPayload {
  id: string;
  title: string;
  content: string;
  department_id: string | null;
  is_anonymous: boolean;
  author_id: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Get authorization header for user verification
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create client with user's token to verify authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.log("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Create service role client for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { question } = await req.json() as { question: QuestionPayload };
    
    // Input validation
    if (!question || !question.id) {
      console.log("Invalid request payload - missing question or id");
      return new Response(
        JSON.stringify({ error: "Invalid request payload" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Received question notification request for question:", question.id);

    // SECURITY: Verify the question exists in the database and belongs to the caller
    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .select("id, author_id, department_id, title, content, is_anonymous")
      .eq("id", question.id)
      .single();

    if (questionError || !questionData) {
      console.log("Question not found:", question.id);
      return new Response(
        JSON.stringify({ error: "Question not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the authenticated user is the author of the question
    if (questionData.author_id !== user.id) {
      console.log("User is not the author of this question");
      return new Response(
        JSON.stringify({ error: "Unauthorized - not the question author" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use validated data from database, not from client payload
    const validatedQuestion = {
      id: questionData.id,
      title: questionData.title,
      content: questionData.content,
      department_id: questionData.department_id,
      is_anonymous: questionData.is_anonymous,
      author_id: questionData.author_id,
    };

    // If no department assigned, skip notification
    if (!validatedQuestion.department_id) {
      console.log("No department assigned to question, skipping notification");
      return new Response(
        JSON.stringify({ message: "No department assigned, skipping" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get department info
    const { data: department, error: deptError } = await supabase
      .from("departments")
      .select("name")
      .eq("id", validatedQuestion.department_id)
      .single();

    if (deptError) {
      console.error("Error fetching department:", deptError);
      throw new Error("Failed to fetch department");
    }

    console.log("Department:", department.name);

    // Get all admins for this specific department
    const { data: departmentAdmins, error: adminsError } = await supabase
      .from("department_admins")
      .select("user_id")
      .eq("department_id", validatedQuestion.department_id);

    if (adminsError) {
      console.error("Error fetching department admins:", adminsError);
      throw new Error("Failed to fetch department admins");
    }

    console.log("Found department admins:", departmentAdmins?.length || 0);

    if (!departmentAdmins || departmentAdmins.length === 0) {
      console.log("No admins found for department, skipping notification");
      return new Response(
        JSON.stringify({ message: "No admins for this department" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get profiles for these admin user_ids
    const adminUserIds = departmentAdmins.map(a => a.user_id);
    const { data: adminProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", adminUserIds);

    if (profilesError) {
      console.error("Error fetching admin profiles:", profilesError);
      throw new Error("Failed to fetch admin profiles");
    }

    if (!adminProfiles || adminProfiles.length === 0) {
      console.log("No profiles found for admins, skipping notification");
      return new Response(
        JSON.stringify({ message: "No profiles for department admins" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get author info if not anonymous
    let authorName = "Anonymous";
    if (!validatedQuestion.is_anonymous && validatedQuestion.author_id) {
      const { data: authorProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", validatedQuestion.author_id)
        .single();
      
      if (authorProfile) {
        authorName = authorProfile.full_name || authorProfile.email;
      }
    }

    // Send email to each department admin
    const emailPromises = adminProfiles.map(async (admin: any) => {
      const adminEmail = admin.email;
      const adminName = admin.full_name || "Admin";

      console.log(`Sending notification to admin (user_id: ${admin.user_id})`);

      try {
        const result = await resend.emails.send({
          from: "GetBlock Q&A <notifications@getblock.io>",
          to: [adminEmail],
          subject: `New Question in ${department.name} Department`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Question Received</h2>
              <p>Hi ${adminName},</p>
              <p>A new question has been submitted to the <strong>${department.name}</strong> department that requires your attention.</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">${validatedQuestion.title}</h3>
                <p style="color: #666;">${validatedQuestion.content.substring(0, 300)}${validatedQuestion.content.length > 300 ? '...' : ''}</p>
                <p style="color: #888; font-size: 14px;">Asked by: ${authorName}</p>
              </div>
              
              <p>Please review and respond to this question at your earliest convenience.</p>
              
              <p style="color: #888; font-size: 12px; margin-top: 30px;">
                This is an automated notification from the GetBlock Q&A system.
              </p>
            </div>
          `,
        });
        
        console.log(`Email sent successfully to admin (user_id: ${admin.user_id})`);
        return { user_id: admin.user_id, success: true };
      } catch (emailError: any) {
        console.error(`Failed to send email to admin (user_id: ${admin.user_id}):`, emailError.message);
        return { user_id: admin.user_id, success: false, error: emailError.message };
      }
    });

    const results = await Promise.all(emailPromises);
    console.log("Email sending completed");

    const successCount = results.filter(r => r.success).length;
    
    return new Response(
      JSON.stringify({ 
        message: `Notifications sent to ${successCount}/${results.length} admins`
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in notify-department-admins function:", error.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
