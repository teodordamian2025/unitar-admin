<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu
        'id'    => '36038935438935c35e360389354389',

        'nume'  => "ALFABETICA SRL",
        'regcom'  => "",
        'cif'  => "4444",
        'adresa' => array(
            'tara'  => "10 4",
            'judet'  => "10 5",
            'oras'  => "10 6",
            'adresa'  => "10 7",
        ),
        'banca' => array(
            'name'  => "10 8",
            'iban'  => "10 9",
        ),
        'contact' => array(
            'name'  => "10 10",
            'email'  => "10 11",
            'telefon'  => "10 12",
            'web'  => "10 13",
        ),
        'defaultintocmit'  => "10 14",
        'capitalsocial'  => "10 15",
        'caen'  => "10 16",
        'tva'  => "10 Da",   // Y/N
        'tvaintracomunitar'  => "10 18",
        'extra'  => "10 19",
    );
    $response = $iApp->firma_modifica($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
