import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'hale-mode-464009-i6',
  credentials: {
    client_email: 'serviceaccount1@hale-mode-464009-i6.iam.gserviceaccount.com',
    private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDNTXDfbdtY4Gfg\ngnucVQjmpdIx6fbweVXBXNKE6LXjM5bQ3BsCwEwiAXlZ94qLyoxheC9lQ3332Cav\n4l0hTkepRFmxCBT/EfFr91+rW8rfngouELCkVHGnJQOiS/pIILMiQav533jLZdiQ\n1GNBJTOzzUylhS8BwQPkZV39vvjPW4AEJeJA3PQVD1tzWW+WAXlMx28RV5bd4RHu\nCYNwKoFlqfLM3Er1GkPsnCMUokGic4dzDkl7jXIvlATDvueslf8xrCS9AwfniJFI\n0L3P/yy2qCdY7a9Af+XXsjObeDdE9A2gRtkQnj7/ZQcFMb7UCqXvvyW2Yb4wznk2\nmZBvS/MpAgMBAAECggEAFG5sKN4n1cnaaKBPsSyQwtR2jU9biw3GNCS60i2PGWXz\nUMSQ3xaYVQuIwkR1eik9jH8vl1Auz30oR3l7e3KtBMpHs0uqvEIywKQJFjZ/w36Y\nxIIWdDovp9rSCGMvjKFNdn+q3+aGoNZZRbuPR6bORQrtwWy2U4I8Ew0n/BZW8Fq8\n/bZQGCUdON91wHOLvC9dGmCcSmuhsbEOD/Lt+y5CGEKup/r/4oyLrFrULSQXwZ74\nkfkzd6GoImi6VQ6P/3ynWqRwFPcFkkVakxMneLkQjemjLpOzDvR+RRIrT4nCLGfF\n+W+lRwOYuZwn9hrU/lgBSvd9ufJXA+JGk51igpANUQKBgQDwT94A7FCulYKynFbG\nHzaVpvX7111syYhD3eMJ4NduWhzmpCz1QAt2mNSJZEdAVf8VOdHa4WBJCNv5/x+r\nd3gPbK4llYA5hIzDVm/JF0iXMe7VtLKtZ1v1cMafv3xIgApFyIOgwH30LsmQ0O7y\naOC7QvmTIFSOC98nJpPVBFhVsQKBgQDatH1ZANtJ+m/thJYYnmXYiP6gVuI7Qjx8\nNHe1IjeIrf7ASkcUXz487TyA2+ETahccDhkumurUsLdV/IE+yUsZ45ErXBVoRMDi\njSz9neD6nsEn1K5DMzHkz4bM40b1JV1mMp04tYQ2BfqFHTvNlZbXu4ObzYF0ugS1\ngSFu+n66+QKBgDIKf5EzpG1mZsvosE0bTNOG6+wgYaz4nm57cv6omlO5YhFJGK+N\nQZXVp1Rg1FF6Vt7FpoRssA8lUCFT1fVvsEmN+QmMgyH3DxTSF/8I4S3S0QghU5+2\nSTjn3gR/7FJwjzMO2RINY20InSKRz2AdJMb54FyZu+HEaRiO+PO/ruFRAoGAVuig\nYwz3F2fAsLceWjwfprOR06+TCQ9iL809wKoPPW4/LLSXmF3cwqNXhrFZuLhQ5KIp\nmZ6QMOLkh/PmfEfLY0dOOdfG3f9sUtrdBQ+HBrCteyGF+khOzGk3XRX37ZTij6kP\nVyiymDE6A0nBqQmHvsTSIMjCZ9s/4cylt48taykCgYAUD4beBfsJyv0GzqmH23vv\nswh4JnCwfJsnhG2mAAw1uxOwHQh7Uu7mLuBZn3YnrktNLV0pIqP5iatSjcRtIRNw\negsy7CxWq8DIIb0DHohtcR2Kw0KIOiHRU0Z6DSlLr3p+30jsn0vqzgBDFLxmi6Pb\nAL5/EhnZtHrFhwAchThbXQ==\n-----END PRIVATE KEY-----`
  }
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('DateFirma1');

    await table.insert(body);

    return NextResponse.json({ success: true, message: 'Date salvate în BigQuery' });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: 'Eroare la salvare',
      error: err.message
    }, { status: 500 });
  }
}