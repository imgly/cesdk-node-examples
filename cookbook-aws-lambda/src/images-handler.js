const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const imagesDB = new AWS.DynamoDB.DocumentClient();

const tableName = process.env.TABLE_NAME;

exports.main = async function (event) {
  const method = event.httpMethod;

  const routeKey = `${event.httpMethod} ${event.resource}`;

  try {
    switch (routeKey) {
      case "POST /images":
        const id = uuidv4();
        const filename = `inspirational-quote-${id}.png`;

        const requestBody = JSON.parse(event.body);

        const result = await imagesDB
          .put({
            TableName: tableName,
            Item: {
              id,
              filename,
              interpolationParams: JSON.stringify({
                quote: requestBody.quote,
              }),
              creationStatus: "PENDING",
              url: "",
            },
          })
          .promise();

        var body = { id };

        break;
      case "GET /images/{id}":
        body = await imagesDB
          .get({
            TableName: tableName,
            Key: {
              id: event.pathParameters.id,
            },
          })
          .promise();
        break;
    }

    return {
      statusCode: 200,
      headers: {},
      body: JSON.stringify(body),
    };
  } catch (error) {
    var body = error.stack || JSON.stringify(error, null, 2);
    return {
      statusCode: 400,
      headers: {},
      body: JSON.stringify(body),
    };
  }
};
