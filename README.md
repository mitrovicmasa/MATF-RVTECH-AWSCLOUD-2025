# MATF-RVTECH-AWSCLOUD-2025

AWS Serverless projekat za prikaz punjača električnih vozila - MATF 2025

## Autori
- Masa Mitrović
- Žarija (dodaj svoje ime)

## Tehnologije
- AWS Lambda (Node.js)
- DynamoDB
- S3
- API Gateway
- LocalStack (za lokalni development)

## Instalacija
```bash
npm install
```

## Pokretanje
```bash
docker-compose up -d
npm run deploy
```

## Struktura projekta
```
├── lambda/              # Lambda funkcije
├── web/                 # Frontend fajlovi
├── scripts/             # Deploy skripte
├── serverless.yml       # Serverless konfiguracija
└── docker-compose.yml   # LocalStack setup
```
