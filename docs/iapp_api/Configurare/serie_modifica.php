<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    /** Logo - Rezoluția trebuie să fie cuprinsă între: 382W x 100H px și 382W x 170H px. */
    $fileContentLogo = file_get_contents("test_logo2.png");
    // Convert the image to base64
    $fileContentLogo = base64_encode($fileContentLogo);

    /** Prepare data */
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu
        
        'id'  => "36038935438935b362362389354389",

        'logo'  => $fileContentLogo,
        'proforma' => array(
            'serie'  => "AX",
            'nr_inceput'  => "2",
            'nr_curent'  => "3",
            'design'  => "2",
        ),
        'factura' => array(
            'serie'  => "BY",
            'nr_inceput'  => "6",
            'nr_curent'  => "7",
            'design'  => "3",
        ),
        'chitanta' => array(
            'serie'  => "CZ",
            'nr_inceput'  => "10",
            'nr_curent'  => "11",
        ),
    
    );
    $response = $iApp->serie_modifica($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
