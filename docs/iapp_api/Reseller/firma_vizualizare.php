<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu
        'id'    => '36038935438935c35d361389354389',
    );
    $response = $iApp->firma_vizualizare($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
