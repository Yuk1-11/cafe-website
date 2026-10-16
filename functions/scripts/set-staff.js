const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const [projectId, email, action = "grant"] = process.argv.slice(2);

if (!projectId || !email || !["grant", "revoke"].includes(action)) {
  console.error("Usage: node scripts/set-staff.js <project-id> <email> [grant|revoke]");
  process.exitCode = 1;
} else {
  initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth();
  auth.getUserByEmail(email)
    .then(async user => {
      const claims = { ...user.customClaims };
      if (action === "grant") claims.staff = true;
      else delete claims.staff;
      await auth.setCustomUserClaims(user.uid, claims);
      console.log(`Staff access ${action === "grant" ? "granted to" : "revoked from"} ${email}. Sign out and sign in again to refresh the token.`);
    })
    .catch(error => {
      console.error("Could not update the staff claim:", error.message);
      process.exitCode = 1;
    });
}
