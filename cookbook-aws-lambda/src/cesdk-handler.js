const CreativeEngine = require("@cesdk/node");
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const imagesDB = new AWS.DynamoDB.DocumentClient();

const bucketName = process.env.BUCKET;
const templateURL = process.env.TEMPLATE_URL;
const tableName = process.env.TABLE_NAME;

const { DesignBlockType, MimeType } = CreativeEngine;

exports.main = async function (event) {
  try {
    const engine = await CreativeEngine.init();
    // load scene from remote template file
    await engine.scene.loadFromURL(templateURL);

    for (const record of event.Records) {
      const item = record.dynamodb.NewImage;

      const filename = item.filename.S;
      const id = item.id.S;
      const interpolationParams = JSON.parse(item.interpolationParams.S);

      // Interpolate text variable from request params
      engine.variable.setString("quote", interpolationParams.quote);

      const [page] = engine.block.findByType(DesignBlockType.Page);
      const renderedImage = await engine.block.export(page, MimeType.Png);
      const imageBuffer = await renderedImage.arrayBuffer();

      // Store rendered image in S3 bucket
      await S3.putObject({
        Bucket: bucketName,
        Body: Buffer.from(imageBuffer),
        ContentType: "image/png",
        Key: filename,
      }).promise();

      // Retrieve image url
      const signedUrl = await S3.getSignedUrlPromise("getObject", {
        Bucket: bucketName,
        Key: filename,
      });

      await imagesDB
        .update({
          TableName: tableName,
          Key: { id },
          AttributeUpdates: {
            url: {
              Action: "PUT",
              Value: { S: signedUrl },
            },
            creationStatus: {
              Action: "PUT",
              Value: { S: "FINISHED" },
            },
          },
          ReturnValues: "UPDATED_NEW",
        })
        .promise();
    }
  } catch (error) {
    console.warn(error);
  }
};
