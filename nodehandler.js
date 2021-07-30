const { createClient } = require("@supabase/supabase-js");
const { decode } = require("base64-arraybuffer");
const { v4 } = require("uuid");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports.upload = async (event) => {
  const body = JSON.parse(event.body);
  const {
    user,
    session,
    error: userError,
  } = await supabase.auth.signIn({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  if (userError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: userError }),
    };
  }
  const fileName = v4();
  const filedata = body.filedata;
  const mimeType = filedata.slice(
    filedata.indexOf(":") + 1,
    filedata.indexOf(";")
  );
  const base64data = filedata.replace(/^data:image\/\w+;base64,/, "");
  const { data, error: storageError } = await supabase.storage
    .from("default-bucket")
    .upload(`admin/${fileName}`, decode(base64data), {
      contentType: mimeType,
    });
  if (storageError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: storageError }),
    };
  }
  const { signedURL, error: signedURLError } = await supabase.storage
    .from("default-bucket")
    .createSignedUrl(`admin/${fileName}`, 3600);
  if (signedURLError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: signedURLError }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        name: fileName,
        url: signedURL,
      },
      null,
      2
    ),
  };
};
