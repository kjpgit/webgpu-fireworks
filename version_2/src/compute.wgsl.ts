export var ComputeCode = `

struct MyComputeRow {
    processed_by: u32,
    input: f32,
    output: f32,
};

@group(0) @binding(0)
var<storage, read_write> compute_mem: array<MyComputeRow>;

@compute @workgroup_size(1)
fn compute_main(
    @builtin(local_invocation_index) local_invocation_index: u32
)
{
    for (var i = 0u; i < arrayLength(&compute_mem); i++) {
        compute_mem[i].processed_by = local_invocation_index;
        compute_mem[i].output = compute_mem[i].input * 2;
    }
}

`;
