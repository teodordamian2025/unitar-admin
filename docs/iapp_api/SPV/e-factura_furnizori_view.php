<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'id_incarcare' => '4211245207',             // obligatoriu

    );
    $response = $iApp->eFactura_view_furnizori($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
