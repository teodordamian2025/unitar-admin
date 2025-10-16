<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu
        
        "nume" => "Denumire client",
        "cifcnp" => "9",
        "regcom" => "8",
        "tip" => "F",
        "contact" => "1",
        "email" => "dev@aninu.ro",
        "telefon" => "3",
        "web" => "4",
        "extra" => "5",
        "banca" => "6",
        "iban" => "7",
        "adresa" => array(
            "tara" => "Romania",
            "judet" => "Bucuresti",
            "oras" => "Sector1",
            "adresa" => "Strada Exemplu, Nr. 1"
        ),
    );
    $response = $iApp->clienti_adauga($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
