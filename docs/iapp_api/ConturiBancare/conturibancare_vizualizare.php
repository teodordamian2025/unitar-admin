<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'id' => '352387352387361387352387',
    );
    $response = $iApp->conturibancare_vizualizare($data_iApp);


    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
