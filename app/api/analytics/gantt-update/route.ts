// ==================================================================
// CALEA: app/api/analytics/gantt-update/route.ts
// DATA: 21.09.2025 15:30 (ora României)
// DESCRIERE: API endpoint pentru actualizarea datelor timeline Gantt Chart - VERSIUNE CORECTATĂ
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

// Funcție pentru normalizarea și validarea ID-urilor
function parseTaskId(taskId: string): { taskType: string; actualId: string } | null {
  console.log('🔍 Parsing taskId:', taskId);
  
  // Verifică dacă taskId-ul începe cu prefix-ul tip_
  const prefixMatch = taskId.match(/^(proiect|subproiect|sarcina)_(.+)$/);
  if (prefixMatch) {
    return {
      taskType: prefixMatch[1],
      actualId: prefixMatch[2]
    };
  }
  
  // Încearc să deduc tipul din structura ID-ului
  if (taskId.includes('_SUB_')) {
    return {
      taskType: 'subproiect',
      actualId: taskId
    };
  } else if (taskId.match(/^\d{4}-\d{2}-\d{2}[a-z]-/)) {
    return {
      taskType: 'proiect',
      actualId: taskId
    };
  } else if (taskId.match(/^[a-f0-9-]{36}$/) || taskId.includes('sarcina')) {
    return {
      taskType: 'sarcina',
      actualId: taskId
    };
  }
  
  // Default la proiect dacă nu pot să determin
  return {
    taskType: 'proiect',
    actualId: taskId
  };
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

    // Parse taskId pentru a determina tipul și ID-ul real
    const parsedTask = parseTaskId(taskId);
    if (!parsedTask) {
      return NextResponse.json({
        success: false,
        error: 'Format taskId invalid!'
      }, { status: 400 });
    }

    const { taskType, actualId } = parsedTask;
    console.log('🔧 Parsed task:', { taskType, actualId });

    let updateQuery = '';
    const queryParams: any = {
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

      default:
        return NextResponse.json({
          success: false,
          error: `Tip task nesuportat: ${taskType}`
        }, { status: 400 });
    }

    console.log('📊 Executing update query pentru:', taskType);
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

    // Verify the update by checking if any rows were affected
    let verifyQuery = '';
    switch (taskType) {
      case 'proiect':
        verifyQuery = `
          SELECT ID_Proiect, Data_Start, Data_Final
          FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
          WHERE ID_Proiect = @actualId
        `;
        break;
      case 'subproiect':
        verifyQuery = `
          SELECT ID_Subproiect, Data_Start, Data_Final
          FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
          WHERE ID_Subproiect = @actualId
        `;
        break;
      case 'sarcina':
        verifyQuery = `
          SELECT id, data_creare, data_scadenta
          FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\`
          WHERE id = @actualId
        `;
        break;
    }

    const verifyOptions = {
      query: verifyQuery,
      params: { actualId: actualId },
      location: 'EU'
    };

    const [verifyJob] = await bigquery.createQueryJob(verifyOptions);
    const [verifyRows] = await verifyJob.getQueryResults();

    if (verifyRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Nu s-au găsit înregistrări pentru ${taskType} cu ID: ${actualId}`
      }, { status: 404 });
    }

    const updatedRecord = verifyRows[0];
    console.log('📊 Verified update:', updatedRecord);

    return NextResponse.json({
      success: true,
      message: `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} actualizat cu succes!`,
      data: {
        taskId,
        taskType,
        actualId,
        startDate,
        endDate,
        updatedRecord
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
