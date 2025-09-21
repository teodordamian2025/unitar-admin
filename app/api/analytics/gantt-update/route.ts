// ==================================================================
// CALEA: app/api/analytics/gantt-update/route.ts
// DATA: 21.09.2025 14:45 (ora României)
// DESCRIERE: API endpoint pentru actualizarea datelor timeline Gantt Chart
// FUNCȚIONALITATE: Update start_date și end_date pentru proiecte, subproiecte și sarcini
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE || undefined,
  credentials: process.env.GOOGLE_CLOUD_KEY_FILE ? undefined : {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

interface UpdateRequest {
  taskId: string;
  startDate: string;
  endDate: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateRequest = await request.json();
    const { taskId, startDate, endDate } = body;

    console.log('📊 Gantt Update Request:', { taskId, startDate, endDate });

    // Validate input data
    if (!taskId || !startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'taskId, startDate și endDate sunt obligatorii!'
      }, { status: 400 });
    }

    // Validate date formats
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json({
        success: false,
        error: 'Format de dată invalid!'
      }, { status: 400 });
    }

    if (endDateObj <= startDateObj) {
      return NextResponse.json({
        success: false,
        error: 'Data de sfârșit trebuie să fie după data de început!'
      }, { status: 400 });
    }

    // Parse taskId to determine type and ID
    // Expected format: "proiect_<ID>", "subproiect_<ID>", "sarcina_<ID>"
    const [taskType, actualId] = taskId.split('_');

    if (!['proiect', 'subproiect', 'sarcina'].includes(taskType) || !actualId) {
      return NextResponse.json({
        success: false,
        error: 'Format taskId invalid! Așteptat: tip_id (ex: proiect_123)'
      }, { status: 400 });
    }

    let updateQuery = '';
    let queryParams: any = {
      startDate: startDate,
      endDate: endDate,
      actualId: actualId
    };

    // Determine which table to update based on task type
    switch (taskType) {
      case 'proiect':
        updateQuery = `
          UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
          SET
            Data_Start = @startDate,
            Data_Final = @endDate
          WHERE ID_Proiect = @actualId
        `;
        break;

      case 'subproiect':
        updateQuery = `
          UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
          SET
            Data_Start = @startDate,
            Data_Final = @endDate,
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Subproiect = @actualId
        `;
        break;

      case 'sarcina':
        updateQuery = `
          UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\`
          SET
            data_creare = @startDate,
            data_scadenta = @endDate,
            updated_at = CURRENT_TIMESTAMP()
          WHERE id = @actualId
        `;
        break;
    }

    console.log('📊 Executing update query:', updateQuery);
    console.log('📊 Query params:', queryParams);

    // Execute the update query
    const options = {
      query: updateQuery,
      params: queryParams,
      location: 'EU'
    };

    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();

    console.log('📊 Update query executed successfully');

    // Verify the update by checking affected rows
    let verifyQuery = '';
    if (taskType === 'proiect') {
      verifyQuery = `
        SELECT COUNT(*) as updated_count
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
        WHERE ID_Proiect = @actualId AND Data_Start = @startDate AND Data_Final = @endDate
      `;
    } else if (taskType === 'subproiect') {
      verifyQuery = `
        SELECT COUNT(*) as updated_count
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
        WHERE ID_Subproiect = @actualId AND Data_Start = @startDate AND Data_Final = @endDate
      `;
    } else if (taskType === 'sarcina') {
      verifyQuery = `
        SELECT COUNT(*) as updated_count
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\`
        WHERE id = @actualId AND data_creare = @startDate AND data_scadenta = @endDate
      `;
    }

    const verifyOptions = {
      query: verifyQuery,
      params: queryParams,
      location: 'EU'
    };

    const [verifyJob] = await bigquery.createQueryJob(verifyOptions);
    const [verifyRows] = await verifyJob.getQueryResults();

    const updatedCount = verifyRows[0]?.updated_count || 0;

    if (updatedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nu s-au găsit înregistrări pentru actualizare!'
      }, { status: 404 });
    }

    // Log the successful update
    console.log(`📊 Successfully updated ${taskType} ${actualId} with new dates: ${startDate} to ${endDate}`);

    return NextResponse.json({
      success: true,
      message: `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} actualizat cu succes!`,
      data: {
        taskId,
        taskType,
        actualId,
        startDate,
        endDate,
        updatedCount
      }
    });

  } catch (error) {
    console.error('❌ Eroare la actualizarea Gantt:', error);

    return NextResponse.json({
      success: false,
      error: 'Eroare la actualizarea datelor în BigQuery!',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Această rută acceptă doar cereri POST pentru actualizarea datelor Gantt!'
  }, { status: 405 });
}