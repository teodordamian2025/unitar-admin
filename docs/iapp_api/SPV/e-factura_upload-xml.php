<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    /** Read file and encode to base64 */
    $filexml = file_get_contents("FACTURA.xml");
    $filexml = base64_encode($filexml);
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu

        'serie' => 'TUPL',          // obligatoriu
        'numar' => '124',     // obligatoriu
        'type' => 'test',     // obligatoriu
        'filexml' => $filexml,     // obligatoriu

    );
    $response = $iApp->eFactura_upload_xml($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
