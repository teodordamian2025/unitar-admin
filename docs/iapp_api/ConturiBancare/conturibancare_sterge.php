<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);
    $data_iApp = array(
        'email_responsabil' => $email,      // obligatoriu
        
        'id'  => "35938835338835d35e388353388",
    
    );
    $response = $iApp->conturibancare_sterge($data_iApp);

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
