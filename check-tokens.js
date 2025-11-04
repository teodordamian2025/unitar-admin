const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

async function checkTokens() {
  const query = `
    SELECT 
      id,
      user_email,
      expires_at,
      data_creare,
      activ,
      LENGTH(refresh_token) as refresh_token_length,
      LENGTH(access_token) as access_token_length
    FROM \`PanouControlUnitar.GoogleDriveTokens\`
    WHERE user_email = 'unitarproiect@gmail.com'
      AND activ = TRUE
    ORDER BY data_creare DESC
    LIMIT 1
  `;

  const [rows] = await bigquery.query({ query, location: 'EU' });

  if (rows.length === 0) {
    console.log('❌ Nu există token activ');
    return;
  }

  const token = rows[0];
  console.log('✅ Token găsit:');
  console.log('   User:', token.user_email);
  console.log('   Data creare:', token.data_creare?.value || token.data_creare);
  console.log('   Expires at:', token.expires_at?.value || token.expires_at);
  console.log('   Access token length:', token.access_token_length, 'chars');
  console.log('   Refresh token length:', token.refresh_token_length, 'chars');
  console.log('   Activ:', token.activ);

  if (token.refresh_token_length > 100) {
    console.log('\n✅ Refresh token EXISTS și e salvat!');
    console.log('📌 Refresh token-ul este PERMANENT (nu expiră)');
    console.log('📌 Expires_at se referă doar la access_token (1 oră)');
    console.log('📌 Auto-refresh va funcționa automat când access_token expiră');
  } else {
    console.log('\n❌ Refresh token MISSING sau prea scurt!');
  }
}

checkTokens().catch(console.error);
