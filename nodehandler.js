const { createClient } = require("@supabase/supabase-js");
const { decode } = require("base64-arraybuffer");
const { v4 } = require("uuid");
const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");
const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const mime = require("mime");

const ddbClient = new DynamoDBClient({ region: "ap-southeast-1" });
const eventBridge = new EventBridgeClient({ region: "ap-southeast-1" });

module.exports.getitem = async (event) => {
  const id = event?.queryStringParameters?.id;
  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "id not found in request query",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
  const data = await ddbClient.send(
    new GetItemCommand({
      TableName: "sht5-table",
      Key: {
        PK: { S: id },
      },
    })
  );
  return {
    statusCode: 200,
    body: JSON.stringify({
      data,
    }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
};

module.exports.upload = async (event) => {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
  const body = JSON.parse(event.body);
  const uploadType = body.type;
  if (uploadType !== "O" && uploadType !== "F") {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `upload type ${uploadType} not recognized`,
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
  const { signedURL, error: signedURLError } = await supabase.storage
    .from("default-bucket")
    .createSignedUrl(`admin/${fileName}.${extension}`, 3600);
  if (signedURLError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: signedURLError }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
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
    body: JSON.stringify({
      id: fileName,
      url: signedURL,
      response,
    }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
};
