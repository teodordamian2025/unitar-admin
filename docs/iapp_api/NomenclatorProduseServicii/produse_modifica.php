<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'id' => '36038935438935b360363389354389',

        'nume' => "Wow nice",
        'descriere' => "O descriere oarecare",
        'um' => "buc.",
        'pret' => "15.21",
        'moneda' => "RON",
    );
    $response = $iApp->produse_modifica($data_iApp);


    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
