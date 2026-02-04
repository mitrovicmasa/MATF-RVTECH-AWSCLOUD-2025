const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// hardkodovan URL da ne bi bilo "undefined" greske
const OCM_API_KEY = process.env.OCM_API_KEY;
const OCM_URL = 'https://api.openchargemap.io/v3/poi/'; 
const TABLE_NAME = process.env.CHARGERS_TABLE;
const BATCH_SIZE = 25;

const DYNAMODB_ENDPOINT = process.env.LOCALSTACK_HOSTNAME
  ? `http://${process.env.LOCALSTACK_HOSTNAME}:4566`
  : 'http://localhost:4566';

const client = new DynamoDBClient({
  endpoint: DYNAMODB_ENDPOINT,
  region: 'us-east-1',
});

const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async () => {
  console.log("Pokrecem Sync sa OpenChargeMap API...");

  try {
    const MAX_RESULTS = 1000;
    const params = new URLSearchParams({
      key: OCM_API_KEY,
      countrycode: 'RS',
      maxresults: MAX_RESULTS,
      compact: true,
      verbose: false,
    });

    // DODATO: headers sa User-Agent da API ne blokira (403 Forbidden)
    const response = await fetch(`${OCM_URL}?${params}`, {
      headers: {
        'User-Agent': 'EV-Chargers-App/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
        throw new Error(`OCM API greska: ${response.status} ${response.statusText}`);
    }

    const chargers = await response.json();
    console.log(`Preuzeto ${chargers.length} punjaca sa OCM`);

    const ttl = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;
    
    const normalizeTown = (town, postcode) => {
      const t = town || '';
      if (['Belgrad', 'Belgrade', 'Beograd'].includes(t)) return 'Belgrade';
      if (postcode?.startsWith('11')) return 'Belgrade'; 
      return t || 'Unknown';
    };
    
    const items = chargers.map(charger => ({
      chargerId: String(charger.ID),
      uuid: charger.UUID,
      town: normalizeTown(charger.AddressInfo?.Town, charger.AddressInfo?.Postcode),
      townRaw: charger.AddressInfo?.Town || 'Unknown',
      title: charger.AddressInfo?.Title,
      addressLine1: charger.AddressInfo?.AddressLine1,
      postcode: charger.AddressInfo?.Postcode,
      latitude: charger.AddressInfo?.Latitude,
      longitude: charger.AddressInfo?.Longitude,
      numberOfPoints: charger.NumberOfPoints,
      ttl,
    }));


    const batches = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: batch.map(item => ({ PutRequest: { Item: item } }))
        }
      }));
    }

    const currentIds = new Set(items.map(item => item.chargerId));
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'chargerId',
    }));

    const staleIds = (scanResult.Items || [])
      .map(item => item.chargerId)
      .filter(id => !currentIds.has(id));
      
    if (staleIds.length > 0) {
      const deleteBatches = [];
      for (let i = 0; i < staleIds.length; i += BATCH_SIZE) {
        deleteBatches.push(staleIds.slice(i, i + BATCH_SIZE));
      }
      for (const batch of deleteBatches) {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch.map(id => ({ DeleteRequest: { Key: { chargerId: id } } }))
          }
        }));
      }
    }

    return {
      statusCode: 200,
      headers: { 
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: "Sinhronizacija uspesna!",
        chargersCount: items.length,
        deletedCount: staleIds.length
      }),
    };
  } catch (error) {
    console.error("Greska:", error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};