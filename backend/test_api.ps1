$login = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$token = $login.token
$h = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

Write-Host "=== API TESTS ==="

# 1. Branches
$b = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/branches" -Headers $h
Write-Host "1. Branches: $($b.success) | Count: $($b.branches.Count)"

# 2. Users with branch info
$u = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/users" -Headers $h
Write-Host "2. Users: $($u.success) | Count: $($u.users.Count)"

# 3. Request leave type='leave'
$body = '{"leave_type":"leave","start_date":"2026-09-05","end_date":"2026-09-05","reason":"test vacation"}'
$l = Invoke-RestMethod -Uri "http://localhost:5000/api/calendar/leaves" -Method POST -Body $body -Headers $h
Write-Host "3. Request Leave: $($l.success) | $($l.message)"

# 4. Request leave type='permission'
$body2 = '{"leave_type":"permission","start_date":"2026-09-06","end_date":"2026-09-06","reason":"doctor"}'
$l2 = Invoke-RestMethod -Uri "http://localhost:5000/api/calendar/leaves" -Method POST -Body $body2 -Headers $h
Write-Host "4. Permission Leave: $($l2.success) | $($l2.message)"

# 5. Get all leaves
$gl = Invoke-RestMethod -Uri "http://localhost:5000/api/calendar/leaves" -Headers $h
Write-Host "5. Get Leaves count: $($gl.leaves.Count)"

# 6. Approve first leave
if ($gl.leaves.Count -gt 0) {
  $lid = $gl.leaves[0].id
  $ap = Invoke-RestMethod -Uri "http://localhost:5000/api/calendar/leaves/$lid/approve" -Method PUT -Body '{"status":"approved"}' -Headers $h
  $msg = $ap.message
  Write-Host "6. Approve Leave ID=$lid : $($ap.success) | $msg"
}

# 7. Register new employee
$emp = '{"username":"test_emp9","password":"test123","full_name":"موظف تجريبي","role":"employee","salary":2500,"branch_id":1}'
$r = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method POST -Body $emp -Headers $h
Write-Host "7. Register Employee: $($r.success) | $($r.message)"

# 8. Verify employee has branch
$u2 = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/users" -Headers $h
$testEmp = $u2.users | Where-Object { $_.username -eq "test_emp9" }
Write-Host "8. Employee branch: $($testEmp.branch_name)"

Write-Host "=== ALL TESTS DONE ==="
