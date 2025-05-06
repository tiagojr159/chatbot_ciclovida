<?php
// URL do arquivo CSV
$url = "http://dados.recife.pe.gov.br/dataset/estoque-dos-medicamentos-nas-farmacias-da-rede-municipal-de-saude/resource/ecd36a57-e9f2-4ef9-a3bb-0cf2f0c02335/download";

// Nome do arquivo local para armazenar o CSV temporariamente
$arquivo_csv = "estoque_medicamentos.csv";

// Inicializa cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Seguir redirecionamentos
curl_setopt($ch, CURLOPT_MAXREDIRS, 5); // Limita o número de redirecionamentos

// Executa a requisição
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Verifica se a requisição foi bem-sucedida
if ($http_code == 200 && $response) {
    file_put_contents($arquivo_csv, $response);
} else {
    die("Erro ao baixar o arquivo CSV. Código HTTP: $http_code");
}

// Lê o CSV e exibe os dados em tabela HTML
if (($handle = fopen($arquivo_csv, "r")) !== FALSE) {
    echo "<h2>Estoque de Medicamentos - Rede Municipal de Saúde de Recife</h2>";
    echo "<table border='1'>";
    
    $cabecalho = fgetcsv($handle, 1000, ","); // Lê o cabeçalho

    if ($cabecalho) {
        echo "<tr>";
        foreach ($cabecalho as $coluna) {
            echo "<th>" . htmlspecialchars($coluna) . "</th>";
        }
        echo "</tr>";

        // Exibe os dados
        while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
            echo "<tr>";
            foreach ($data as $campo) {
                echo "<td>" . htmlspecialchars($campo) . "</td>";
            }
            echo "</tr>";
        }
    } else {
        echo "Erro ao processar o cabeçalho do CSV.";
    }
    
    echo "</table>";
    fclose($handle);
} else { 
    echo "Erro ao abrir o arquivo CSV.";
}

// Remove o arquivo CSV temporário após o uso
unlink($arquivo_csv);
?>
 