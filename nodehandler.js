const { createClient } = require("@supabase/supabase-js");

// Create a single supabase client for interacting with your database
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports.upload = async (event) => {
  const { user, session, error } = await supabase.auth.signIn({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: user,
      },
      null,
      2
    ),
  };
};
