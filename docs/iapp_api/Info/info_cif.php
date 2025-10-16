<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'cif' => '49235450',                       // obligatoriu

    );
    $response = $iApp->info_cif($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
