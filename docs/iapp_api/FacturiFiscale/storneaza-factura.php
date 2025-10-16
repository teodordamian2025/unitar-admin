<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'serie' => 'BY',          // obligatoriu
        'numar' => '8',     // obligatoriu

    );
    $response = $iApp->storneaza_factura($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
