<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'id' => '36738a35538a35c35d36036038a35538a',

        "nume" => "Denumire client",
        "cifcnp" => "RO1234567890",
        "regcom" => "123",
        "tip" => "J",
        "contact" => "1",
        "email" => "dev@aninu.ax",
        "telefon" => "3",
        "web" => "4",
        "extra" => "5",
        "banca" => "6",
        "iban" => "7",
        "adresa" => array(
            "tara" => "8",
            "judet" => "9",
            "oras" => "10",
            "adresa" => "11"
        ),
    );
    $response = $iApp->clienti_modifica($data_iApp);


    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
