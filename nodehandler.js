const { createClient } = require("@supabase/supabase-js");
const { decode } = require("base64-arraybuffer");
const { v4 } = require("uuid");
const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");
const mime = require("mime");

const eventBridge = new EventBridgeClient({ region: "ap-southeast-1" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports.upload = async (event) => {
  const body = JSON.parse(event.body);
  const uploadType = body.type;
  if (uploadType !== "O" && uploadType !== "F") {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `upload type ${uploadType} not recognized`,
      }),
    };
  }
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
  const extension = mime.getExtension(mimeType);
  const base64data = filedata.replace(/^data:image\/\w+;base64,/, "");
  const { data, error: storageError } = await supabase.storage
    .from("default-bucket")
    .upload(`admin/${fileName}.${extension}`, decode(base64data), {
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
    .createSignedUrl(`admin/${fileName}.${extension}`, 3600);
  if (signedURLError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: signedURLError }),
    };
  }
  const command = new PutEventsCommand({
    Entries: [
      {
        Source: "nodehandler",
        DetailType: `IMAGE_${uploadType}_UPLOADED`,
        Detail: JSON.stringify({
          id: fileName,
          url: signedURL,
          ext: extension,
        }),
      },
    ],
  });
  const response = await eventBridge.send(command);
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        id: fileName,
        url: signedURL,
        response,
      },
      null,
      2
    ),
  };
};
