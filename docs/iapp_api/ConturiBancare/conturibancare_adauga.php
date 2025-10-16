<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu
        
        'nume' => "Contul Bancar Test",
        'iban' => "RO49AAAA1B31007593840000",
        'moneda' => "RON",
        'swift' => "AAAA",
        'descriere' => "aceasta este o descriere a contului bancar test",
    );
    $response = $iApp->conturibancare_adauga($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
