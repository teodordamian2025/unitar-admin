<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'id_descarcare' => '3283015416',             // obligatoriu
        'output' => '3283015416.zip',             // obligatoriu

    );
    $response = $iApp->eFactura_descarca_furnizori($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
