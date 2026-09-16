$loginCashier = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"cashier1","password":"cashier123"}'
$tokenC = $loginCashier.token
$hC = @{ Authorization = "Bearer $tokenC"; "Content-Type" = "application/json" }

$loginEmp = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"emp1","password":"emp123"}'
$empId = $loginEmp.user.id

Write-Host "=== TEST CASHIER ISSUING ADVANCE & ICE CREAM ==="
Write-Host "Emp1 ID: $empId"

# 1. Cashier issues advance of 150 EGP for Emp1
$advBody = "{`"user_id`":$empId, `"amount`":150, `"note`":`"سلفة طوارئ من الكاشير`"}"
$advRes = Invoke-RestMethod -Uri "http://localhost:5000/api/hr/advance" -Method POST -Headers $hC -Body $advBody
Write-Host "1. Cashier Issue Advance: $($advRes.success) | $($advRes.message)"

# 2. Cashier issues Ice Cream order for Emp1
$iceBody = "{`"user_id`":$empId, `"items`":[ {`"name`":`"بوله اتنين`", `"price`":35, `"qty`":1} ]}"
$iceRes = Invoke-RestMethod -Uri "http://localhost:5000/api/hr/ice-cream-order" -Method POST -Headers $hC -Body $iceBody
Write-Host "2. Cashier Issue Ice Cream: $($iceRes.success) | $($iceRes.message)"

# 3. Fetch advances for Emp1 and inspect issuer details
$advList = Invoke-RestMethod -Uri "http://localhost:5000/api/hr/advances/$empId" -Headers $hC
Write-Host "3. Advances List for Emp1 Count: $($advList.advances.Count)"
$advList.advances | ForEach-Object {
  Write-Host "  - Type: $($_.type) | Amount: $($_.amount) | Reason: $($_.reason) | Issuer: $($_.issuer_name) ($($_.issuer_role))"
}

# 4. Request Shift Swap
$tokenEmp = $loginEmp.token
$hE = @{ Authorization = "Bearer $tokenEmp"; "Content-Type" = "application/json" }
$swapBody = '{"leave_type":"shift_swap","start_date":"2026-09-10","reason":"🔄 تبديل شيفت: من [مسائي / بليل] إلى [صباحي / الصبح] • البديل: سامي الموظف"}'
$swapRes = Invoke-RestMethod -Uri "http://localhost:5000/api/calendar/leaves" -Method POST -Headers $hE -Body $swapBody
Write-Host "4. Request Shift Swap: $($swapRes.success) | $($swapRes.message)"

Write-Host "=== TEST COMPLETE ==="
