<?PHP
	
    include('api.php');
    include('config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'client' => [
            'type' => "F",  /** F / J  - persoana fizica sau juridica */
            'name' => unaccent("S******I M**LóS-A****A"),
            // 'tva' => "N",   - doar pentru Juridic
             'cif' => "presoana_fizica",  // - doar pentru Juridic
            // 'regcom' => "RRRR/123/125126",   - doar pentru Juridic
            'contact' => " S******I M**LóS-A****A",       // nume si prenume
            'cnp' => "1231231231123",     // optional
            'telefon' => "072567",    // optional
            'tara' => "R",          // obligatoriu
            'judet' => "Jud",       // obligatoriu
            'localitate' => "Loc",  // obligatoriu
            'adresa' => "Str",      // obligatoriu
            'banca' => "tes",       // optional
            'iban' => "www",        // optional
            'email' => "devaw@test.com",    // optional
            'web' => "dat",         // optional
            'extra' => "ccw2",      // optional
        ],
        'data_start' => date("Y-m-d"),  // data emiterii
        'data_termen' => '1',       // Numar de zile de la data emiterii
        'seria' => 'SERIE_TEST',     // serie factura (obligatoriu sa existe in aplicatie)
        'moneda' => 'RON',  // Moneda
        'footer' => [
            'intocmit_name' => 'aaaa bbbb'      // nume si prenume cine emite factura
        ],
        'continut' => [
            [
                'title' => 'produs ceva',
                'um' => 'buc',
                'cantitate' => '3',
                'pret' => '2',
                'tvavalue' => '1.1',
                'tvapercent' => '19',
            ], [
                'title' => 'ok sa vindem mere',
                'descriere' => "ceva sa fie aici la noi\n si la voi sa fie bine",
                'um' => 'buc',
                'cantitate' => '5',
                'pret' => '10',
                'tvavalue' => '66',
                'tvapercent' => '5',
            ]
        ]
    );
    $response = $iApp->emite_factura($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";

