<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu
        
        'nume'  => "ALFABETICA SRL",
        'regcom'  => "2",
        'cif'  => "33333",
        'adresa' => array(
            'tara'  => "4",
            'judet'  => "5",
            'oras'  => "6",
            'adresa'  => "7",
        ),
        'banca' => array(
            'name'  => "12",
            'iban'  => "9",
        ),
        'contact' => array(
            'name'  => "10",
            'email'  => "11",
            'telefon'  => "12",
            'web'  => "13",
        ),
        'defaultintocmit'  => "14",
        'capitalsocial'  => "15",
        'caen'  => "16",
        'tva'  => "17",   // Y/N
        'tvaintracomunitar'  => "18",
        'extra'  => "19",
    );
    $response = $iApp->firma_adauga($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
