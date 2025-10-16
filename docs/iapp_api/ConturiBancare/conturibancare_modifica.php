<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'id' => '35938835338835d35c388353388',

        'nume' => "Contul Bancar Tes",
        'iban' => "RRRRXXAAAA1B31007593840000",
        'moneda' => "RON",
        'swift' => "",
        'descriere' => "aceasta est4e o descriere a contului bancar test",
    );
    $response = $iApp->conturibancare_modifica($data_iApp);


    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
