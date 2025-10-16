<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu
    );
    $response = $iApp->clienti_lista($data_iApp);


    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
