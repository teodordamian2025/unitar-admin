<?PHP 

    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    //error_reporting(E_ERROR | E_PARSE);
    error_reporting(E_ALL);

    class iAppAPIClient{
        private $hash = '';
        private $api_url = 'https://api-facturare.inap.ro/';
        function __construct($user, $pw) {
            $this->hash = base64_encode($user.':'.$pw);
        }
        private function curl($url, $data, $hasFiles = false) {
            $headers = array("Authorization: Basic " . $this->hash);
            if ($hasFiles){
                // array_push($headers, "Content-Type: multipart/form-data");
            }
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            curl_setopt($ch, CURLOPT_HEADER, 0);
            curl_setopt($ch, CURLOPT_VERBOSE, 0);
            curl_setopt($ch, CURLOPT_TIMEOUT, 300);
            if ( !empty($data) ) {
                curl_setopt($ch, CURLOPT_POST, 1);
                curl_setopt($ch, CURLOPT_POSTFIELDS, (json_encode($data, false)));
            }
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            return $ch;
        }
        public function execute($url, $data='', $download = false, $hasFiles = false) {
            if(function_exists('curl_init') === false){
                throw new Exception(" cURL is not enabled!");
            }
            $ch = $this->curl($url, $data, $hasFiles);
            if ($download == true){
                if (isset($data['output'])){
                    $fp = fopen($data['output'], 'w+');
                    curl_setopt($ch, CURLOPT_FILE, $fp);
                }else{
                    $fp = fopen("output.zip", 'w+');
                    curl_setopt($ch, CURLOPT_FILE, $fp);
                }
            }
            $return = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curl_errno = curl_errno($ch);
            $curl_error = curl_error($ch);
            curl_close($ch);
            // echo $return;
            if ($curl_errno > 0) {
                throw new Exception("cURL Error ($curl_errno): $curl_error");
            }
            return json_decode($return, true);
        }
        public function emite_proforma($data){
            return $this->execute($this->api_url . "emite/proforma", $data);
        }
        public function emite_factura($data){
            return $this->execute($this->api_url . "emite/factura", $data);
        }
        public function emite_proforma_v2($data){
            return $this->execute($this->api_url . "emite/proforma-v2", $data);
        }
        public function emite_factura_v2($data){
            return $this->execute($this->api_url . "emite/factura-v2", $data);
        }
        public function view_proforma($data){
            return $this->execute($this->api_url . "vizualizare/proforma", $data);
        }
        public function view_factura($data){
            return $this->execute($this->api_url . "vizualizare/factura", $data);
        }
        public function cancel_proforma($data){
            return $this->execute($this->api_url . "anuleaza/proforma", $data);
        }
        public function cancel_factura($data){
            return $this->execute($this->api_url . "anuleaza/factura", $data);
        }
        public function incaseaza_factura($data){
            return $this->execute($this->api_url . "incaseaza/factura", $data);
        }
        public function storneaza_factura($data){
            return $this->execute($this->api_url . "storneaza/factura", $data);
        }

        /** Nomenclator Clienti */
        public function clienti_lista($data){
            return $this->execute($this->api_url . "clienti/lista", $data);
        }
        public function clienti_vizualizare($data){
            return $this->execute($this->api_url . "clienti/vizualizare", $data);
        }
        public function clienti_adauga($data){
            return $this->execute($this->api_url . "clienti/adauga", $data);
        }
        public function clienti_modifica($data){
            return $this->execute($this->api_url . "clienti/modifica", $data);
        }
        public function clienti_sterge($data){
            return $this->execute($this->api_url . "clienti/sterge", $data);
        }
        /** END - Nomenclator Clienti */

        /** Nomenclator Produse / Servicii */
        public function produse_lista($data){
            return $this->execute($this->api_url . "produse/lista", $data);
        }
        public function produse_vizualizare($data){
            return $this->execute($this->api_url . "produse/vizualizare", $data);
        }
        public function produse_adauga($data){
            return $this->execute($this->api_url . "produse/adauga", $data);
        }
        public function produse_modifica($data){
            return $this->execute($this->api_url . "produse/modifica", $data);
        }
        public function produse_sterge($data){
            return $this->execute($this->api_url . "produse/sterge", $data);
        }
        /** END - Nomenclator Produse / Servicii */

        /** Configurare serii facturi */
        public function serie_lista($data){
            return $this->execute($this->api_url . "serie/lista", $data);
        }
        public function serie_vizualizare($data){
            return $this->execute($this->api_url . "serie/vizualizare", $data);
        }
        public function serie_design($data){
            return $this->execute($this->api_url . "serie/design", $data);
        }
        public function serie_adauga($data){
            return $this->execute($this->api_url . "serie/adauga", $data, false, true);
        }
        public function serie_modifica($data){
            return $this->execute($this->api_url . "serie/modifica", $data, false, true);
        }
        public function serie_sterge($data){
            return $this->execute($this->api_url . "serie/sterge", $data);
        }
        public function serie_sterge_logo($data){
            return $this->execute($this->api_url . "serie/sterge-logo", $data);
        }
        /** END - Configurare serii facturi */

        /** Conturi bancare */
        public function conturibancare_lista($data){
            return $this->execute($this->api_url . "conturibancare/lista", $data);
        }
        public function conturibancare_vizualizare($data){
            return $this->execute($this->api_url . "conturibancare/vizualizare", $data);
        }
        public function conturibancare_adauga($data){
            return $this->execute($this->api_url . "conturibancare/adauga", $data);
        }
        public function conturibancare_modifica($data){
            return $this->execute($this->api_url . "conturibancare/modifica", $data);
        }
        public function conturibancare_sterge($data){
            return $this->execute($this->api_url . "conturibancare/sterge", $data);
        }
        /** END - Conturi bancare */

        /** Curs Valutar */
        public function curs_valutar($data = array()){
            return $this->execute($this->api_url . "vizualizare/cursvalutar", $data);
        }
        /** END Curs Valutar */

        /** Informații generale */
        public function info_cif($data){
            return $this->execute($this->api_url . "info/cif", $data);
        }
        /** END - Informații generale */

        /** SPV */
        public function factureaza_proforma($data){
            return $this->execute($this->api_url . "factureaza/proforma", $data);
        }
        public function eFactura_furnizori($data){
            return $this->execute($this->api_url . "e-factura/furnizori", $data);
        }
        public function eFactura_emise($data){
            return $this->execute($this->api_url . "e-factura/emise", $data);
        }
        public function eFactura_descarca_furnizori($data){
            return $this->execute($this->api_url . "e-factura/descarca-furnizori", $data, true);
        }
        public function eFactura_descarca_emise($data){
            return $this->execute($this->api_url . "e-factura/descarca-emise", $data, true);
        }
        public function eFactura_view_furnizori($data){
            return $this->execute($this->api_url . "e-factura/view-furnizori", $data);
        }
        public function eFactura_view_emise($data){
            return $this->execute($this->api_url . "e-factura/view-emise", $data);
        }
        public function eFactura_upload_status($data){
            return $this->execute($this->api_url . "e-factura/upload-status", $data);
        }
        public function eFactura_upload_xml($data){
            return $this->execute($this->api_url . "e-factura/upload-xml", $data, false, true);
        }
        /** END - SPV */

        /** Reseller */
        public function firma_lista($data){
            return $this->execute($this->api_url . "firma/lista", $data);
        }
        public function firma_vizualizare($data){
            return $this->execute($this->api_url . "firma/vizualizare", $data);
        }
        public function firma_api($data){
            return $this->execute($this->api_url . "firma/api", $data);
        }
        public function firma_apireset($data){
            return $this->execute($this->api_url . "firma/api-reset", $data);
        }
        public function firma_adauga($data){
            return $this->execute($this->api_url . "firma/adauga", $data);
        }
        public function firma_modifica($data){
            return $this->execute($this->api_url . "firma/modifica", $data);
        }
        public function firma_dezactiveaza($data){
            return $this->execute($this->api_url . "firma/dezactiveaza", $data);
        }
        public function firma_activeaza($data){
            return $this->execute($this->api_url . "firma/activeaza", $data);
        }
        public function eFactura_autorizare($data){
            return $this->execute($this->api_url . "e-factura/autorizare", $data);
        }
        /** END Reseller */
    }

    /** Characters filter */
    function unaccent($str){
        $transliteration = array(
            'Ĳ' => 'I', 'Ö' => 'O','Œ' => 'O','Ü' => 'U','ä' => 'a','æ' => 'a',
            'ĳ' => 'i','ö' => 'o','œ' => 'o','ü' => 'u','ß' => 's','ſ' => 's',
            'À' => 'A','Á' => 'A','Â' => 'A','Ã' => 'A','Ä' => 'A','Å' => 'A',
            'Æ' => 'A','Ā' => 'A','Ą' => 'A','Ă' => 'A','Ç' => 'C','Ć' => 'C',
            'Č' => 'C','Ĉ' => 'C','Ċ' => 'C','Ď' => 'D','Đ' => 'D','È' => 'E',
            'É' => 'E','Ê' => 'E','Ë' => 'E','Ē' => 'E','Ę' => 'E','Ě' => 'E',
            'Ĕ' => 'E','Ė' => 'E','Ĝ' => 'G','Ğ' => 'G','Ġ' => 'G','Ģ' => 'G',
            'Ĥ' => 'H','Ħ' => 'H','Ì' => 'I','Í' => 'I','Î' => 'I','Ï' => 'I',
            'Ī' => 'I','Ĩ' => 'I','Ĭ' => 'I','Į' => 'I','İ' => 'I','Ĵ' => 'J',
            'Ķ' => 'K','Ľ' => 'K','Ĺ' => 'K','Ļ' => 'K','Ŀ' => 'K','Ł' => 'L',
            'Ñ' => 'N','Ń' => 'N','Ň' => 'N','Ņ' => 'N','Ŋ' => 'N','Ò' => 'O',
            'Ó' => 'O','Ô' => 'O','Õ' => 'O','Ø' => 'O','Ō' => 'O','Ő' => 'O',
            'Ŏ' => 'O','Ŕ' => 'R','Ř' => 'R','Ŗ' => 'R','Ś' => 'S','Ş' => 'S',
            'Ŝ' => 'S','Ș' => 'S','Š' => 'S','Ť' => 'T','Ţ' => 'T','Ŧ' => 'T',
            'Ț' => 'T','Ù' => 'U','Ú' => 'U','Û' => 'U','Ū' => 'U','Ů' => 'U',
            'Ű' => 'U','Ŭ' => 'U','Ũ' => 'U','Ų' => 'U','Ŵ' => 'W','Ŷ' => 'Y',
            'Ÿ' => 'Y','Ý' => 'Y','Ź' => 'Z','Ż' => 'Z','Ž' => 'Z','à' => 'a',
            'á' => 'a','â' => 'a','ã' => 'a','ā' => 'a','ą' => 'a','ă' => 'a',
            'å' => 'a','ç' => 'c','ć' => 'c','č' => 'c','ĉ' => 'c','ċ' => 'c',
            'ď' => 'd','đ' => 'd','è' => 'e','é' => 'e','ê' => 'e','ë' => 'e',
            'ē' => 'e','ę' => 'e','ě' => 'e','ĕ' => 'e','ė' => 'e','ƒ' => 'f',
            'ĝ' => 'g','ğ' => 'g','ġ' => 'g','ģ' => 'g','ĥ' => 'h','ħ' => 'h',
            'ì' => 'i','í' => 'i','î' => 'i','ï' => 'i','ī' => 'i','ĩ' => 'i',
            'ĭ' => 'i','į' => 'i','ı' => 'i','ĵ' => 'j','ķ' => 'k','ĸ' => 'k',
            'ł' => 'l','ľ' => 'l','ĺ' => 'l','ļ' => 'l','ŀ' => 'l','ñ' => 'n',
            'ń' => 'n','ň' => 'n','ņ' => 'n','ŉ' => 'n','ŋ' => 'n','ò' => 'o',
            'ó' => 'o','ô' => 'o','õ' => 'o','ø' => 'o','ō' => 'o','ő' => 'o',
            'ŏ' => 'o','ŕ' => 'r','ř' => 'r','ŗ' => 'r','ś' => 's','š' => 's',
            'ť' => 't','ù' => 'u','ú' => 'u','û' => 'u','ū' => 'u','ů' => 'u',
            'ű' => 'u','ŭ' => 'u','ũ' => 'u','ų' => 'u','ŵ' => 'w','ÿ' => 'y',
            'ý' => 'y','ŷ' => 'y','ż' => 'z','ź' => 'z','ž' => 'z','Α' => 'A',
            'Ά' => 'A','Ἀ' => 'A','Ἁ' => 'A','Ἂ' => 'A','Ἃ' => 'A','Ἄ' => 'A',
            'Ἅ' => 'A','Ἆ' => 'A','Ἇ' => 'A','ᾈ' => 'A','ᾉ' => 'A','ᾊ' => 'A',
            'ᾋ' => 'A','ᾌ' => 'A','ᾍ' => 'A','ᾎ' => 'A','ᾏ' => 'A','Ᾰ' => 'A',
            'Ᾱ' => 'A','Ὰ' => 'A','ᾼ' => 'A','Β' => 'B','Γ' => 'G','Δ' => 'D',
            'Ε' => 'E','Έ' => 'E','Ἐ' => 'E','Ἑ' => 'E','Ἒ' => 'E','Ἓ' => 'E',
            'Ἔ' => 'E','Ἕ' => 'E','Ὲ' => 'E','Ζ' => 'Z','Η' => 'I','Ή' => 'I',
            'Ἠ' => 'I','Ἡ' => 'I','Ἢ' => 'I','Ἣ' => 'I','Ἤ' => 'I','Ἥ' => 'I',
            'Ἦ' => 'I','Ἧ' => 'I','ᾘ' => 'I','ᾙ' => 'I','ᾚ' => 'I','ᾛ' => 'I',
            'ᾜ' => 'I','ᾝ' => 'I','ᾞ' => 'I','ᾟ' => 'I','Ὴ' => 'I','ῌ' => 'I',
            'Θ' => 'T','Ι' => 'I','Ί' => 'I','Ϊ' => 'I','Ἰ' => 'I','Ἱ' => 'I',
            'Ἲ' => 'I','Ἳ' => 'I','Ἴ' => 'I','Ἵ' => 'I','Ἶ' => 'I','Ἷ' => 'I',
            'Ῐ' => 'I','Ῑ' => 'I','Ὶ' => 'I','Κ' => 'K','Λ' => 'L','Μ' => 'M',
            'Ν' => 'N','Ξ' => 'K','Ο' => 'O','Ό' => 'O','Ὀ' => 'O','Ὁ' => 'O',
            'Ὂ' => 'O','Ὃ' => 'O','Ὄ' => 'O','Ὅ' => 'O','Ὸ' => 'O','Π' => 'P',
            'Ρ' => 'R','Ῥ' => 'R','Σ' => 'S','Τ' => 'T','Υ' => 'Y','Ύ' => 'Y',
            'Ϋ' => 'Y','Ὑ' => 'Y','Ὓ' => 'Y','Ὕ' => 'Y','Ὗ' => 'Y','Ῠ' => 'Y',
            'Ῡ' => 'Y','Ὺ' => 'Y','Φ' => 'F','Χ' => 'X','Ψ' => 'P','Ω' => 'O',
            'Ώ' => 'O','Ὠ' => 'O','Ὡ' => 'O','Ὢ' => 'O','Ὣ' => 'O','Ὤ' => 'O',
            'Ὥ' => 'O','Ὦ' => 'O','Ὧ' => 'O','ᾨ' => 'O','ᾩ' => 'O','ᾪ' => 'O',
            'ᾫ' => 'O','ᾬ' => 'O','ᾭ' => 'O','ᾮ' => 'O','ᾯ' => 'O','Ὼ' => 'O',
            'ῼ' => 'O','α' => 'a','ά' => 'a','ἀ' => 'a','ἁ' => 'a','ἂ' => 'a',
            'ἃ' => 'a','ἄ' => 'a','ἅ' => 'a','ἆ' => 'a','ἇ' => 'a','ᾀ' => 'a',
            'ᾁ' => 'a','ᾂ' => 'a','ᾃ' => 'a','ᾄ' => 'a','ᾅ' => 'a','ᾆ' => 'a',
            'ᾇ' => 'a','ὰ' => 'a','ᾰ' => 'a','ᾱ' => 'a','ᾲ' => 'a','ᾳ' => 'a',
            'ᾴ' => 'a','ᾶ' => 'a','ᾷ' => 'a','β' => 'b','γ' => 'g','δ' => 'd',
            'ε' => 'e','έ' => 'e','ἐ' => 'e','ἑ' => 'e','ἒ' => 'e','ἓ' => 'e',
            'ἔ' => 'e','ἕ' => 'e','ὲ' => 'e','ζ' => 'z','η' => 'i','ή' => 'i',
            'ἠ' => 'i','ἡ' => 'i','ἢ' => 'i','ἣ' => 'i','ἤ' => 'i','ἥ' => 'i',
            'ἦ' => 'i','ἧ' => 'i','ᾐ' => 'i','ᾑ' => 'i','ᾒ' => 'i','ᾓ' => 'i',
            'ᾔ' => 'i','ᾕ' => 'i','ᾖ' => 'i','ᾗ' => 'i','ὴ' => 'i','ῂ' => 'i',
            'ῃ' => 'i','ῄ' => 'i','ῆ' => 'i','ῇ' => 'i','θ' => 't','ι' => 'i',
            'ί' => 'i','ϊ' => 'i','ΐ' => 'i','ἰ' => 'i','ἱ' => 'i','ἲ' => 'i',
            'ἳ' => 'i','ἴ' => 'i','ἵ' => 'i','ἶ' => 'i','ἷ' => 'i','ὶ' => 'i',
            'ῐ' => 'i','ῑ' => 'i','ῒ' => 'i','ῖ' => 'i','ῗ' => 'i','κ' => 'k',
            'λ' => 'l','μ' => 'm','ν' => 'n','ξ' => 'k','ο' => 'o','ό' => 'o',
            'ὀ' => 'o','ὁ' => 'o','ὂ' => 'o','ὃ' => 'o','ὄ' => 'o','ὅ' => 'o',
            'ὸ' => 'o','π' => 'p','ρ' => 'r','ῤ' => 'r','ῥ' => 'r','σ' => 's',
            'ς' => 's','τ' => 't','υ' => 'y','ύ' => 'y','ϋ' => 'y','ΰ' => 'y',
            'ὐ' => 'y','ὑ' => 'y','ὒ' => 'y','ὓ' => 'y','ὔ' => 'y','ὕ' => 'y',
            'ὖ' => 'y','ὗ' => 'y','ὺ' => 'y','ῠ' => 'y','ῡ' => 'y','ῢ' => 'y',
            'ῦ' => 'y','ῧ' => 'y','φ' => 'f','χ' => 'x','ψ' => 'p','ω' => 'o',
            'ώ' => 'o','ὠ' => 'o','ὡ' => 'o','ὢ' => 'o','ὣ' => 'o','ὤ' => 'o',
            'ὥ' => 'o','ὦ' => 'o','ὧ' => 'o','ᾠ' => 'o','ᾡ' => 'o','ᾢ' => 'o',
            'ᾣ' => 'o','ᾤ' => 'o','ᾥ' => 'o','ᾦ' => 'o','ᾧ' => 'o','ὼ' => 'o',
            'ῲ' => 'o','ῳ' => 'o','ῴ' => 'o','ῶ' => 'o','ῷ' => 'o','А' => 'A',
            'Б' => 'B','В' => 'V','Г' => 'G','Д' => 'D','Е' => 'E','Ё' => 'E',
            'Ж' => 'Z','З' => 'Z','И' => 'I','Й' => 'I','К' => 'K','Л' => 'L',
            'М' => 'M','Н' => 'N','О' => 'O','П' => 'P','Р' => 'R','С' => 'S',
            'Т' => 'T','У' => 'U','Ф' => 'F','Х' => 'K','Ц' => 'T','Ч' => 'C',
            'Ш' => 'S','Щ' => 'S','Ы' => 'Y','Э' => 'E','Ю' => 'Y','Я' => 'Y',
            'а' => 'A','б' => 'B','в' => 'V','г' => 'G','д' => 'D','е' => 'E',
            'ё' => 'E','ж' => 'Z','з' => 'Z','и' => 'I','й' => 'I','к' => 'K',
            'л' => 'L','м' => 'M','н' => 'N','о' => 'O','п' => 'P','р' => 'R',
            'с' => 'S','т' => 'T','у' => 'U','ф' => 'F','х' => 'K','ц' => 'T',
            'ч' => 'C','ш' => 'S','щ' => 'S','ы' => 'Y','э' => 'E','ю' => 'Y',
            'я' => 'Y','ð' => 'd','Ð' => 'D','þ' => 't','Þ' => 'T','ა' => 'a',
            'ბ' => 'b','გ' => 'g','დ' => 'd','ე' => 'e','ვ' => 'v','ზ' => 'z',
            'თ' => 't','ი' => 'i','კ' => 'k','ლ' => 'l','მ' => 'm','ნ' => 'n',
            'ო' => 'o','პ' => 'p','ჟ' => 'z','რ' => 'r','ს' => 's','ტ' => 't',
            'უ' => 'u','ფ' => 'p','ქ' => 'k','ღ' => 'g','ყ' => 'q','შ' => 's',
            'ჩ' => 'c','ც' => 't','ძ' => 'd','წ' => 't','ჭ' => 'c','ხ' => 'k',
            'ჯ' => 'j','ჰ' => 'h' 
        );
        $str = str_replace(array_keys($transliteration), array_values($transliteration), $str);
        return $str;
    }
