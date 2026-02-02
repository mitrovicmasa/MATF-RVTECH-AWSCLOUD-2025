const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const fetch = require('node-fetch');

const TABLE_NAME = process.env.CHARGERS_TABLE;
const OCM_API_KEY = process.env.OCM_API_KEY || '';

const DYNAMODB_ENDPOINT = process.env.LOCALSTACK_HOSTNAME
  ? `http://${process.env.LOCALSTACK_HOSTNAME}:4566`
  : 'http://localhost:4566';

const client = new DynamoDBClient({
  endpoint: DYNAMODB_ENDPOINT,
  region: 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('🚀 Lambda funkcija pokrenuta!');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    console.log('🗑️ Brisanje starih podataka...');
    await clearOldData();

    console.log('🌍 Preuzimanje podataka sa OCM API-ja...');
    const chargers = await fetchChargersFromOCM();
    console.log(`✅ Preuzeto ${chargers.length} punjača`);

    console.log('💾 Snimanje u DynamoDB...');
    await saveChargersToDB(chargers);
    console.log('✅ Podaci uspešno snimljeni!');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', 
      },
      body: JSON.stringify({
        message: 'Sinhronizacija uspešna!',
        chargersCount: chargers.length,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('❌ Greška:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Greška pri sinhronizaciji',
        details: error.message,
      }),
    };
  }
};


async function clearOldData() {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
  }));

  if (!result.Items || result.Items.length === 0) {
    console.log('📭 Nema starih podataka za brisanje');
    return;
  }

  for (const item of result.Items) {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { chargerId: item.chargerId },
    }));
  }

  console.log(`🗑️ Obrisano ${result.Items.length} starih zapisa`);
}

async function fetchChargersFromOCM() {
  const OCM_URL = `https://api.openchargemap.io/v3/poi/?output=json&countrycode=234&maxresults=100&compact=true&verbose=false&key=${OCM_API_KEY}`;

  console.log('🔗 API URL:', OCM_URL);

  const response = await fetch(OCM_URL);
  
  if (!response.ok) {
    throw new Error(`OCM API greška: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return data.map((charger) => ({
    chargerId: String(charger.ID), 
    town: charger.AddressInfo?.Town || 'Unknown',
    address: charger.AddressInfo?.AddressLine1 || 'N/A',
    postcode: charger.AddressInfo?.Postcode || 'N/A',
    latitude: charger.AddressInfo?.Latitude || 0,
    longitude: charger.AddressInfo?.Longitude || 0,
    numberOfPoints: charger.NumberOfPoints || 0,
    usageType: charger.UsageType?.Title || 'Unknown',
    statusType: charger.StatusType?.Title || 'Unknown',
    dateLastStatusUpdate: charger.DateLastStatusUpdate || new Date().toISOString(),
  }));
}

async function saveChargersToDB(chargers) {
  for (const charger of chargers) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: charger,
    }));
  }

  console.log(`💾 Snimljeno ${chargers.length} punjača u DynamoDB`);
}