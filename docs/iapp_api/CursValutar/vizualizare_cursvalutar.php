<?PHP
	
    include('../api.php');
    include('../config.php');
    
    /** API CALL */
    $iApp = new iAppAPIClient($user, $pw);

    $response = $iApp->curs_valutar();

    /** 
     * output[DATA] -> Data actualizarii
     * Restul sunt monedele de schimb valutar
     **/

    echo ">>><pre>";
    print_r($response);
    echo "</pre>";
