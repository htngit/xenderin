const crypto = require('crypto');

// Data dari DUITKU
const merchantCode = 'DS26088';
const apiKey = 'a0e48014050467df11c98edd977cfd08';

// Test case 1: Simple test
const merchantOrderId = 'TEST123';
const paymentAmount = 10000;

const signatureString = merchantCode + merchantOrderId + paymentAmount + apiKey;
console.log('Signature String:', signatureString);

const signature = crypto.createHash('md5').update(signatureString).digest('hex');
console.log('MD5 Signature:', signature);

// Test case 2: Real data from your log
const realOrderId = 'ORD-1763790009053-ce73a29f';
const realAmount = 960000;

const realSignatureString = merchantCode + realOrderId + realAmount + apiKey;
console.log('\nReal Signature String:', realSignatureString);

const realSignature = crypto.createHash('md5').update(realSignatureString).digest('hex');
console.log('Real MD5 Signature:', realSignature);
console.log('Expected from log: c5f990c037cb03d4b4f3ad3918645142');
console.log('Match:', realSignature === 'c5f990c037cb03d4b4f3ad3918645142');
