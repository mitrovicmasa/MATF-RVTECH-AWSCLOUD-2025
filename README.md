# MATF-RVTECH-AWSCLOUD-2025

AWS Serverless projekat za prikaz punjača električnih vozila na kursu "Razvoj aplikacija u klaud okruženju"- MATF 2026

## Autori
- Maša Mitrović
- Zarija Trtović

## Tehnologije
- AWS Lambda (Node.js)
- DynamoDB
- S3
- API Gateway
- LocalStack (za lokalni development)


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
