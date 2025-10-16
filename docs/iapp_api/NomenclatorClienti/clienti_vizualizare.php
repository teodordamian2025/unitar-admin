<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'id' => '36738a35538a35c35d36036038a35538a',
    );
    $response = $iApp->clienti_vizualizare($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
