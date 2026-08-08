/**
 * One-shot helper: generate a VAPID keypair and print the .env lines to add.
 *   node scripts/generate-vapid.mjs
 * The public key MUST be prefixed NEXT_PUBLIC_ so the browser can read it
 * to subscribe. Keep the private key server-side only.
 */
import webPush from "web-push";

const { publicKey, privateKey } = webPush.generateVAPIDKeys();

console.log("# Add these to your .env (private key must stay secret):");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
console.log(`VAPID_CONTACT="mailto:info@digiarendus.ee"`);
