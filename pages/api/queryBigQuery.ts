// pages/api/queryBigQuery.ts

import { BigQuery } from '@google-cloud/bigquery';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const bigquery = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: 'cheia-ta-de-service-account.json' // doar pe server
  });

  const query = req.body.query;
  try {
    const [job] = await bigquery.createQueryJob({ query });
    const [rows] = await job.getQueryResults();
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
