const { execSync } = require('child_process');

const BUCKET_NAME = 'punjaci-website';
const CONTAINER_NAME = 'matf-rvtech-awscloud-2025_localstack_1';

console.log('Deploying frontend to S3 via Docker...');

try {
  const dockerCmd = `docker exec ${CONTAINER_NAME} sh -c "
    export AWS_ACCESS_KEY_ID=test &&
    export AWS_SECRET_ACCESS_KEY=test &&
    export AWS_DEFAULT_REGION=us-east-1 &&
    aws --endpoint-url=http://localhost:4566 s3 mb s3://${BUCKET_NAME} 2>/dev/null || true &&
    aws --endpoint-url=http://localhost:4566 s3 website s3://${BUCKET_NAME} --index-document index.html &&
    aws --endpoint-url=http://localhost:4566 s3api put-bucket-acl --bucket ${BUCKET_NAME} --acl public-read
  "`;
  
  execSync(dockerCmd, { stdio: 'inherit' });
  
  execSync(`docker cp web/index.html ${CONTAINER_NAME}:/tmp/index.html`, { stdio: 'inherit' });
  
  const uploadCmd = `docker exec ${CONTAINER_NAME} sh -c "
    export AWS_ACCESS_KEY_ID=test &&
    export AWS_SECRET_ACCESS_KEY=test &&
    export AWS_DEFAULT_REGION=us-east-1 &&
    aws --endpoint-url=http://localhost:4566 s3 cp /tmp/index.html s3://${BUCKET_NAME}/index.html --content-type text/html
  "`;
  
  execSync(uploadCmd, { stdio: 'inherit' });

  console.log('\nFrontend deployed successfully!');
  console.log(`URL: http://${BUCKET_NAME}.s3-website.localhost.localstack.cloud:4566/`);
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
}
