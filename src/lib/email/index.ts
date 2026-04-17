// Email barrel — re-exporta transport (Resend) + utilidades internas
// (oauth state, unsubscribe tokens) para consumers via "@/lib/email".
export {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
} from "./resend-transport";
