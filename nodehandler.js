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
const colors = require("./colors.json");

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
  const item = data.Item;
  if (!item) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        color: "not found",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
  const isFMode =
    item.mean_r?.N !== undefined &&
    item.mean_g?.N !== undefined &&
    item.mean_b?.N !== undefined;
  const isOMode = item.distance?.N !== undefined;
  if (!isFMode && !isOMode) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        color: "not found",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  } else if (isFMode) {
    const meanR = parseInt(item.mean_r.N);
    const meanG = parseInt(item.mean_g.N);
    const meanB = parseInt(item.mean_b.N);
    const name = colors
      .map((color) => ({
        name: color.name,
        cosine:
          (color.R * meanR + color.G * meanG + color.B * meanB) /
          Math.sqrt(
            (meanR * meanR + meanG * meanG + meanB * meanB) *
              (color.R * color.R + color.G * color.G + color.B * color.B)
          ),
      }))
      .sort((a, b) => b.cosine - a.cosine)[0].name;
    return {
      statusCode: 200,
      body: JSON.stringify({
        color: name,
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  } else {
    return {
      statusCode: 200,
      body: JSON.stringify({
        distance: item.distance?.N,
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
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
