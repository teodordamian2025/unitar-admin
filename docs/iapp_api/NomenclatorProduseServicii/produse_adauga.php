<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu
        
        'nume' => "Produs X x1234",
        'descriere' => "O descriere oarecare",
        'um' => "buc.",
        'pret' => "15",
        'moneda' => "RON",
    );
    $response = $iApp->produse_adauga($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
