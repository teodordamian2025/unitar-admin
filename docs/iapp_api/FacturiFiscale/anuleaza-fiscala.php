<?PHP
	
    include('api.php');
    include('config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'serie' => 'SERIE_TEST',          // obligatoriu
        'numar' => '19',     // obligatoriu

    );
    $response = $iApp->cancel_factura($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
