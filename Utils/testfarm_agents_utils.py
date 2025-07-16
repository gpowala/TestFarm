import os


__all__ = [
    "add_custom_magic_variable",
    "expand_magic_variables",
    "stringify_magic_variables",
    "get_magic_variable",
    "set_magic_variable"
]


default_magic_variables = {
    '$__TF_TESTS_REPOS_DIR__': 'TF_TESTS_REPOS_DIR',
    '$__TF_TOOLS_DIR__': 'TF_TOOLS_DIR',
    '$__TF_WORK_DIR__': 'TF_WORK_DIR',
    '$__TF_TEMP_DIR__': 'TF_TEMP_DIR',

    '$__TF_BENCH_ITER__': 'TF_BENCH_ITER'
}


custom_magic_variables = {
    
}


def get_environment_variable(magic_variables: dict, name: str) -> str:
    env_var_name = magic_variables[name]
    env_var_value = os.getenv(env_var_name)

    if env_var_value is None:
        raise ValueError(f"Environment variable {env_var_name} is not set.")

    return env_var_value


def add_custom_magic_variable(name: str, value: str):
    if not name or not value:
        raise ValueError("Custom magic variable name and value must not be empty.")
    
    if not name.startswith('$__') or not name.endswith('__'):
        raise ValueError(f"Custom magic variable name is incorrect. Please stick to $__CUSTOM_VAR_NAME__ format.")
    
    magic_variables = {**default_magic_variables, **custom_magic_variables}

    if name in magic_variables:
        raise ValueError(f"Magic variable {name} already exists.")
    
    env_var_name = name[3:-2].upper()
    custom_magic_variables[name] = env_var_name

    os.environ[env_var_name] = value


def expand_magic_variables(text: str) -> str:
    expanded_text = text

    magic_variables = {**default_magic_variables, **custom_magic_variables}

    for key in magic_variables:
       expanded_text = expanded_text.replace(key, get_environment_variable(magic_variables, key))

    return expanded_text


def get_magic_variable(name: str) -> str:
    if not name:
        raise ValueError("Magic variable name must not be empty.")

    if not name.startswith('$__') or not name.endswith('__'):
        raise ValueError(f"Magic variable name is incorrect. Please stick to $__VAR_NAME__ format.")
    
    magic_variables = {**default_magic_variables, **custom_magic_variables}

    if name not in magic_variables:
        raise ValueError(f"Magic variable {name} does not exist.")

    return get_environment_variable(magic_variables, name)


def set_magic_variable(name: str, value: str):
    if not name or not value:
        raise ValueError("Magic variable name and value must not be empty.")

    if not name.startswith('$__') or not name.endswith('__'):
        raise ValueError(f"Magic variable name is incorrect. Please stick to $__VAR_NAME__ format.")

    if name not in custom_magic_variables and name not in default_magic_variables:
        raise ValueError(f"Magic variable {name} does not exist.")

    if name in custom_magic_variables:
        os.environ[custom_magic_variables[name]] = value
    else:
        os.environ[default_magic_variables[name]] = value


def stringify_magic_variables() -> str:
    magic_variables = {**default_magic_variables, **custom_magic_variables}
    return "\n".join([f"{key}={get_environment_variable(magic_variables, key)}" for key in magic_variables])

