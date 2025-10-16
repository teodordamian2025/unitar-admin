<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'start' => '2024-01-01',                    // obligatoriu (Y-m-d)
        'end' => date("Y-m-d", time()+24*60*60),    // obligatoriu (Y-m-d)

    );
    $response = $iApp->eFactura_emise($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
