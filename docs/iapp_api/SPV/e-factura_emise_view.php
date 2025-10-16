<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'id_incarcare' => '4198437619',             // obligatoriu

    );
    $response = $iApp->eFactura_view_emise($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
